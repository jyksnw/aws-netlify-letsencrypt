'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotyaml')();
}

// Set the AWS_REGION for local testing
if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'us-east-1';
}

const NETLIFY_CLIENT_ID = process.env.NETLIFY_CLIENT_ID;
const NETLIFY_CLIENT_SECRET = process.env.NETLIFY_CLIENT_SECRET;
const NETLIFY_DNS_ZONE_NAME = process.env.NETLIFY_DNS_ZONE_NAME;

const AWS_S3_ACME_BUCKET = process.env.AWS_S3_ACME_BUCKET;

const ACME_EMAIL_ADDRESS = process.env.ACME_EMAIL_ADDRESS;
const ACME_DOMAIN_NAME = process.env.ACME_DOMAIN_NAME;
const ACME_TEST = process.env.ACME_TEST;

const fs = require('fs');
const dns = require('dns');

const AWS = require('aws-sdk');
const Pledge = require('bluebird');
AWS.config.setPromisesDependency(Pledge);

const s3 = new AWS.S3();
const acm = new AWS.ACM();

const moment = require('moment');
const letiny = require('letiny');
const request = require('request');
const netlify = require('netlify').createClient({
  client_id: NETLIFY_CLIENT_ID,
  client_secret: NETLIFY_CLIENT_SECRET
});

const certFiles = [
  'cert.pem',
  'privkey.pem',
  'cacert.pem',
  'accountkey.pem',
  'account.pem'
];

function getBucketFile (bucket, file) {
  let params = {
    Bucket: bucket,
    Key: file
  };

  return new Pledge((resolve, reject) => {
    let headObject = s3.headObject(params).promise();
    headObject
      .then(data => {
        let getObject = s3.getObject(params).promise();
        getObject
          .then(data => resolve(data.Body))
          .catch(err => reject(err));
      })
      .catch(err => {
        reject(err);
      });
  });
}

function putFile (bucket, fileName, fileData) {
  let params = {
    Bucket: bucket,
    Key: fileName,
    Body: fileData
  };

  return new Pledge((resolve, reject) => {
    s3.putObject(params)
      .promise()
      .then(url => resolve(url))
      .catch(err => reject(err));
  });
}

function loadTempDirectoryFromBucket (bucket, files) {
  return Pledge.all(
    files.map(file => {
      return new Pledge((resolve, reject) => {
        getBucketFile(bucket, file)
          .then(data => {
            fs.writeFile('/tmp/' + file, data, 'utf8', err => {
              if (err) {
                reject(err);
              } else {
                resolve(null);
              }
            });
          })
          .catch(err => {
            if (err && err.code === 'NotFound') {
              resolve(null);
            } else {
              reject(err);
            }
          });
      });
    })
  );
}

function dumpTempDirectoryToBucket (bucket, files) {
  return Pledge.all(
    files.map(file => {
      return new Pledge((resolve, reject) => {
        fs.stat('/tmp/' + file, (err, stats) => {
          if (!err && stats.isFile()) {
            fs.readFile('/tmp/' + file, (err, data) => {
              if (err) {
                reject(err);
              } else {
                putFile(bucket, file, data)
                  .then(url => resolve(null))
                  .catch(err => reject(err));
              }
            });
          } else {
            resolve(null);
          }
        });
      });
    })
  );
}

function cleanupTempDirectory (files) {
  return Pledge.all(
    files.map(file => {
      return new Pledge((resolve, reject) => {
        fs.stat('/tmp/' + file, (err, stats) => {
          if (!err && stats.isFile()) {
            fs.unlink('/tmp/' + file, err => {
              if (err) {
                reject(err);
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        });
      });
    })
  );
}

function removeZoneRecord (token, zoneId, recordId) {
  return new Pledge((resolve, reject) => {
    let uri =
      'https://api.netlify.com/api/v1/dns_zones/' +
      zoneId +
      '/dns_records/' +
      recordId;

    request.delete(
      uri,
      {
        headers: {
          Authorization: 'Bearer ' + token
        }
      },
      (err, resp, body) => {
        if (err) {
          reject(err);
        } else {
          if (resp.statusCode >= 200 && resp.statusCode < 300) {
            resolve(resp.statusCode);
          } else {
            reject(resp.statusMessage);
          }
        }
      }
    );
  });
}

function wait (timeout) {
  return new Pledge(resolve => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

function resolveTxtRecord (endpoint) {
  return new Pledge((resolve, reject) => {
    console.log('Attempting to resolve TXT', endpoint);
    dns.resolveTxt(endpoint, (err, data) => {
      if (err && err.code === dns.NOTFOUND) {
        console.log('Waiting', 1000, 'ms');
        wait(1000).then(() => {
          resolveTxtRecord(endpoint)
            .then(data => resolve(data))
            .catch(err => reject(err));
        });
      } else if (err) {
        console.log('Error resolving TXT', endpoint, err);
        reject(err);
      } else {
        console.log('Resolved TXT', endpoint);
        resolve(data);
      }
    });
  });
}

function checkCertificateRenewal (cert) {
  return new Pledge((resolve, reject) => {
    fs.stat(cert, (err, stats) => {
      if (!err && stats.isFile()) {
        fs.readFile(cert, 'utf8', (err, data) => {
          if (err) {
            reject(err);
          } else {
            try {
              let expirationDate = letiny.getExpirationDate(data);
              let renewalDate = moment(expirationDate).subtract(30, 'days');
              let today = moment(new Date());

              resolve({
                renew: today.isSameOrAfter(renewalDate),
                expirationDate: expirationDate
              });
            } catch (err) {
              reject(err);
            }
          }
        });
      } else {
        resolve({ renew: true });
      }
    });
  });
}

function renewCertificate (zone) {
  return new Pledge((resolve, reject) => {
    let recordId = null;
    letiny.getCert(
      {
        email: ACME_EMAIL_ADDRESS,
        domains: ACME_DOMAIN_NAME,
        certFile: '/tmp/cert.pem',
        keyFile: '/tmp/privkey.pem',
        caFile: '/tmp/cacert.pem',
        privateKey: '/tmp/accountkey.pem',
        accountKey: '/tmp/account.pem',
        agreeTerms: true,
        method: 'dns-01',
        url:
          ACME_TEST === 'true'
            ? 'https://acme-staging.api.letsencrypt.org'
            : 'https://acme-v01.api.letsencrypt.org/',
        challenge: function (domain, _, data, done) {
          let endpoint = '_acme-challenge.' + domain;
          zone
            .createRecord({
              hostname: endpoint,
              type: 'TXT',
              value: data,
              ttl: 30
            })
            .then(record => {
              recordId = record.id;

              resolveTxtRecord(endpoint).then(() => done(null)).catch(err => {
                done(err);
              });
            })
            .catch(err => {
              done(err);
            });
        }
      },
      (err, cert, privKey, caCert, accountKey) => {
        if (err) {
          reject(err);
        } else {
          var params = {
            Certificate: cert,
            PrivateKey: privKey,
            CertificateChain: caCert
          };

          acm
            .importCertificate(params)
            .promise()
            .then(data => resolve({ arn: data, record: recordId }))
            .catch(err => reject(err));
        }
      }
    );
  });
}

process.on('uncaughtException', function (err) {
  console.log(err);
});

module.exports.renew_certificate = (event, context, callback) => {
  let start = moment.now();
  let renew = new Pledge((resolve, reject) => {
    netlify
      .authorizeFromCredentials()
      .then(token => {
        netlify
          .dnsZones()
          .then(zones => {
            netlify
              .dnsZone(
                zones.find(zone => zone.name === NETLIFY_DNS_ZONE_NAME).id
              )
              .then(zone => {
                loadTempDirectoryFromBucket(
                  AWS_S3_ACME_BUCKET,
                  certFiles
                ).then(() => {
                  checkCertificateRenewal('/tmp/cert.pem')
                    .then(results => {
                      if (results.renew) {
                        renewCertificate(zone)
                          .then(data => {
                            removeZoneRecord(
                              token,
                              zone.id,
                              data.record
                            ).catch(err => console.log('ERROR', err));

                            dumpTempDirectoryToBucket(
                              AWS_S3_ACME_BUCKET,
                              certFiles
                            )
                              .then(() => {
                                cleanupTempDirectory(certFiles).catch(err =>
                                  console.log('ERROR', err)
                                );

                                resolve(
                                  'Certificate generated and uploaded to AWS'
                                );
                              })
                              .catch(err => {
                                console.log('ERROR', err);
                                cleanupTempDirectory(certFiles)
                                  .catch(err => console.log('ERROR', err))
                                  .finally(() => reject(err));
                              });
                          })
                          .catch(err => {
                            console.log('ERROR', err);

                            cleanupTempDirectory(certFiles)
                              .catch(err => console.log('ERROR', err))
                              .finally(() => reject(err));
                          });
                      } else {
                        cleanupTempDirectory(certFiles)
                          .catch(err => console.log('ERROR', err))
                          .finally(() =>
                            resolve(
                              'Certificate expires on ' + results.expirationDate
                            )
                          );
                      }
                    })
                    .catch(err => {
                      console.log('ERROR', err);

                      cleanupTempDirectory(certFiles)
                        .catch(err => console.log('ERROR', err))
                        .finally(() => reject(err));
                    });
                });
              });
          })
          .catch(err => reject(err));
      })
      .catch(err => reject(err));
  });

  renew
    .then(status => callback(null, status))
    .catch(err => callback(err, 'ERROR'))
    .finally(() => console.log('Finished', moment.now() - start, 'ms'));
};
