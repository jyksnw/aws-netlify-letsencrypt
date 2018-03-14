'use strict'

import moment from 'moment'
import Pledge from 'bluebird'
import le from 'letiny'

import fs from './lib/fs-lib'
import resolveTxt from './lib/dns-lib'

import AWS from 'aws-sdk'
import Table from './lib/dynamodb-lib'
import Bucket from './lib/s3-lib'
import NetlifyClient from './lib/netlify-lib'

// Load in development variables
if (process.env.NODE_ENV !== 'production') {
  require('dotyaml')()
}

// Set the AWS_REGION for local testing
if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'us-east-1'
}

AWS.config.setPromisesDependency(Pledge)
const acm = new AWS.ACM({region: process.env.AWS_REGION})
const sns = new AWS.SNS({region: process.env.AWS_REGION})

const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN
const NETLIFY_DNS_ZONE_NAME = process.env.NETLIFY_DNS_ZONE_NAME
const ACME_BUCKET = process.env.ACME_BUCKET
const ACME_TABLE = process.env.ACME_TABLE
const ACME_EMAIL_ADDRESS = process.env.ACME_EMAIL_ADDRESS
const ACME_DOMAIN_NAMES = process.env.ACME_DOMAIN_NAMES.split(',')
const ACME_TEST = process.env.ACME_TEST || true
const AWS_SNS_TOPIC = process.env.AWS_SNS_TOPIC

const table = new Table(ACME_TABLE)
const bucket = new Bucket(ACME_BUCKET)
const netlify = new NetlifyClient(NETLIFY_TOKEN, NETLIFY_DNS_ZONE_NAME)

const certFiles = [
  'cert.pem',
  'privkey.pem',
  'cacert.pem',
  'accountkey.pem',
  'account.pem'
]

function breakPromise () {
  return Pledge.reject('break')
}

function checkExpirationDate (record) {
  console.log('Checking if certificate needs to be renewed', record.Item.id)
  return new Pledge(resolve => {
    if (record === undefined || !record.Item || !record.Item.expirationDate) {
      // treat a null record as needing to establish a new cert
      return resolve(true)
    }

    const expirationDate = new Date(record.Item.expirationDate)
    const renewalDate = moment(expirationDate).subtract(14, 'days')
    const today = moment(new Date())

    return resolve(today.isSameOrAfter(renewalDate))
  })
}

function renewCertificate (domain) {
  console.log(`Renewing certificate for ${domain}`)
  return new Pledge((resolve, reject) => {
    le.getCert({
      email: ACME_EMAIL_ADDRESS,
      domains: domain,
      certFile: `/tmp/${domain}/cert.pem`,
      keyFile: `/tmp/${domain}/privkey.pem`,
      caFile: `/tmp/${domain}/cacert.pem`,
      privateKey: `/tmp/${domain}/accountkey.pem`,
      accountKey: `/tmp/${domain}/account.pem`,
      agreeTerms: true,
      method: 'dns-01',
      url:
          ACME_TEST === 'true'
            ? 'https://acme-staging.api.letsencrypt.org'
            : 'https://acme-v01.api.letsencrypt.org/',
      challenge: function (endpoint, _, data, done) {
        console.log(`Generating certificate challenge for ${domain}`)
        const url = '_acme-challenge.' + endpoint
        netlify.createRecord({
          hostname: url,
          type: 'TXT',
          value: data,
          ttl: 30
        })
          .then(record => {
            resolveTxt(record.hostname)
              .then(() => done())
              .catch(err => reject(err))
          })
          .catch(err => reject(err))
      }
    }, (err, cert, privateKey, caCert, accountKey) => {
      if (err) {
        return reject(err)
      }

      console.log(`Received new certificate for ${domain}`)
      var params = {
        Certificate: cert,
        PrivateKey: privateKey,
        CertificateChain: caCert
      }

      return resolve(params)
    })
  })
}

function loadCertificates (domain) {
  console.log(`Loading cached certificates for ${domain} from S3`)
  const baseBucket = `${domain}`
  const tmpDir = `/tmp/${domain}`

  fs.mkdir(tmpDir)
    .catch(err => Pledge.reject(err))
    .then(() => {
      return Pledge.all(certFiles.map(file => {
        return new Pledge((resolve, reject) => {
          const bucketKey = `${baseBucket}/${file}`
          const tmpFile = `${tmpDir}/${file}`

          bucket.getFile(bucketKey)
            .then(data => {
              fs.write(tmpFile, data)
                .then(() => resolve())
                .catch(err => reject(err))
            })
            .catch(err => {
              if (err && (err.code === 'NoSuchKey' || err.code === 'NotFound')) {
                return resolve()
              }

              return reject(err)
            })
        })
      }))
    })
}

function copyCertificates (domain) {
  console.log(`Moving locally cached certificates for ${domain} to S3`)
  const baseBucket = `${domain}`
  const tmpDir = `/tmp/${domain}`

  return Pledge.all(certFiles.map(file => {
    return new Pledge((resolve, reject) => {
      const bucketKey = `${baseBucket}/${file}`
      const tmpFile = `${tmpDir}/${file}`

      fs.exists(tmpFile)
        .then(exists => {
          if (!exists) {
            return resolve()
          }

          fs.read(tmpFile)
            .then(data => {
              bucket.putFile(bucketKey, data)
                .then(() => resolve())
                .catch(err => reject(err))
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }))
}

function unloadCertificates (domain) {
  console.log(`Removing locally cached certificates for ${domain}`)
  const tmpDir = `/tmp/${domain}`

  return Pledge.all(certFiles.map(file => {
    return new Pledge((resolve, reject) => {
      const tmpFile = `${tmpDir}/${file}`

      fs.exists(tmpFile)
        .then(exists => {
          if (!exists) {
            return resolve()
          }

          fs.delete(tmpFile)
            .then(() => resolve())
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }))
    .then(() => fs.rmdir(tmpDir))
    .catch(err => {
      fs.rmdir(tmpDir)
        .then(() => Pledge.reject(err))
        .catch(err => Pledge.reject(err))
    })
}

module.exports.renew_certificate = (event, context, callback) => {
  ACME_DOMAIN_NAMES.forEach(domain => {
    table.getItem(domain)
      .then(record => checkExpirationDate(record))
      .then(renew => {
        if (!renew) {
          console.log(`${domain} doesn't need to be renewed at this time`)
          return breakPromise()
        }

        return loadCertificates(domain)
      })
      .then(() => {
        return renewCertificate(domain)
      })
      .then(certificate => {
        console.log(`Uploading ${domain} certificate to Certificate Manager`)
        return acm.importCertificate(certificate).promise()
      })
      .then(data => {
        const params = {
          Message: data.CertificateArn || JSON.stringify(data),
          TopicArn: AWS_SNS_TOPIC
        }

        console.log(`Publishing new ${domain} certificate Arn to ${AWS_SNS_TOPIC}`)
        return Pledge.all([
          table.putItem({
            id: domain,
            expirationDate: moment(new Date()).add(90, 'days').valueOf(),
            certificateArn: data.CertificateArn
          }),
          sns.publish(params).promise()
        ])
      })
      .then(() => copyCertificates(domain))
      .then(() => unloadCertificates(domain))
      .then(() => {
        console.log(`Clearing DNS challenge record for ${domain}`)
        return netlify.getRecordsByHostname('_acme-challenge.' + domain)
          .then(records => {
            return Pledge.all(records.map(record => {
              return netlify.deleteRecord(record)
            }))
          })
      })
      .catch(err => {
        if (err !== 'break') {
          console.log(err)
        }
      })
      .finally(() => {
        // Sanity check in case we got here after an error
        console.log(`Performing cleanup of ${domain}`)
        unloadCertificates(domain)
          .catch(err => console.log(`Could not delete local cache for ${domain}\n`, err))
          .finally(() => console.log(`Finished handling ${domain}`))
      })
  })
}
