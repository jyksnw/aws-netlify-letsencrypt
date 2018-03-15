'use strict'
import dns from 'dns'
import Pledge from 'bluebird'

const wait = function (timeout) {
  return new Pledge(resolve => {
    setTimeout(() => resolve(), timeout)
  })
}

export default function resolveTxt (uri, timeout = 10000) {
  const recursiveResolveTxt = function (count) {
    return new Pledge((resolve, reject) => {
      if (count <= 0) {
        reject(new Error(`timeout: could not resolve ${uri}`))
      } else {
        dns.resolveTxt(uri, (err, addresses) => {
          if (err && err.code === dns.NOTFOUND) {
            wait(timeout / 10)
              .then(() => {
                recursiveResolveTxt(count - 1)
                  .then((data) => resolve({uri: uri, data: data}))
                  .catch(err => reject(err))
              })
          } else if (err) {
            reject(err)
          } else {
            resolve({uri: uri, data: addresses})
          }
        })
      }
    })
  }

  return recursiveResolveTxt(10)
}
