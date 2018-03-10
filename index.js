const Pledge = require('bluebird')
const handler = require('./handler')

/**
 * Attempts to generate or renew a Let's Encrypt Certificate. Any generated or renewed certificates
 * will then be uploaded to an AWS S3 bucket and imported into AWS Certificate Manager. This method returns
 * a promise unless a {renewCertificateCallback} is provided.
 * @param {renewCertificateCallback} callback An optional callback that handles any returned errors or status values.
 */
const renewCertificate = callback => {
  return new Pledge((resolve, reject) => {
    handler.renew_certificate(null, null, (err, status) => {
      if (err) {
        callback ? callback(err, null) : reject(err)
      } else {
        callback ? callback(null, status) : resolve(status)
      }
    })
  })
}

module.exports = renewCertificate

if (require.main === module) {
  renewCertificate((err, status) => {
    if (err) {
      console.log(err)
    } else {
      console.log(status)
    }
  })
}

/**
 * The renewCertificate callback
 * @callback renewCertificateCallback
 * @param {Error} err {null if there is no error}
 * @param {string | Object}
 */
