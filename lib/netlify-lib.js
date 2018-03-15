'use strict'
import axios from 'axios'
import Pledge from 'bluebird'

const isValidResponse = function (response) {
  return (
    response &&
    response.status &&
    (response.status >= 200 && response.status < 300)
  )
}

const cacheRecord = function (cache, record) {
  const r = cache.find(v => v.id === record.id)

  if (r === undefined) {
    cache.push(record)
  }
}

export default class NetlifyClient {
  constructor (token, zoneName) {
    this.token = token
    this.zoneName = zoneName
    this.zoneId = null
    this.cache = []

    this.client = axios.create({
      baseURL: 'https://api.netlify.com/api/v1',
      timeout: 10000,
      headers: {
        common: {
          Authorization: `Bearer ${this.token}`
        }
      }
    })
  }

  getZone () {
    return new Pledge((resolve, reject) => {
      if (this.zoneId) {
        return resolve(this.zoneId)
      }

      this.client
        .get('/dns_zones')
        .then(response => {
          if (isValidResponse(response)) {
            this.zoneId = response.data.find(
              zone => zone.name === this.zoneName
            ).id
            if (this.zoneId !== undefined) {
              resolve(this.zoneId)
            } else {
              reject(new Error(`Could not find zone for ${this.zoneName}`))
            }
          } else {
            reject(response.statusText)
          }
        })
        .catch(err => reject(err))
    })
  }

  getRecords (force = false) {
    return new Pledge((resolve, reject) => {
      if (Object.keys(this.cache).length > 0 && !force) {
        resolve(this.cache)
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .get(`/dns_zones/${zoneId}/dns_records`)
            .then(response => {
              if (isValidResponse(response)) {
                const records = response.data
                records.forEach(record => {
                  cacheRecord(this.cache, record)
                })

                resolve(records)
              } else {
                reject(response.statusText)
              }
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }

  getRecord (record, force = false) {
    return new Pledge((resolve, reject) => {
      if (!record) {
        reject(new Error('record is required'))
      }

      if (record instanceof Object) {
        record = record.id
      }

      const r = this.cache.find(r => r.id === record)
      if (r === undefined && !force) {
        return resolve(r)
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .get(`/dns_zones/${zoneId}/dns_records/${record}`)
            .then(response => {
              if (isValidResponse(response)) {
                cacheRecord(this.cache, record)
                resolve(response.data)
              } else {
                reject(response.statusText)
              }
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }

  getRecordsByHostname (hostname, force = false) {
    return new Pledge((resolve, reject) => {
      if (this.cache.length > 0 && !force) {
        const records = this.cache.filter(r => r.hostname === hostname)
        if (records !== undefined && records.length > 0) {
          return resolve(records)
        }
      }

      this.getRecords(force)
        .then(records => {
          const wanted = records.filter(r => r.hostname === hostname)
          resolve(wanted)
        })
        .catch(err => reject(err))
    })
  }

  createRecord (record) {
    return new Pledge((resolve, reject) => {
      if (!record) {
        return reject(new Error('record is required'))
      }

      if (!record.hostname) {
        return reject(new Error('hostname is required'))
      }

      if (!record.type) {
        return reject(new Error('record type is required'))
      }

      if (!record.value) {
        return reject(new Error('record value is required'))
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .post(`/dns_zones/${zoneId}/dns_records`, record, {
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': JSON.stringify(record).length
              }
            })
            .then(response => {
              if (isValidResponse(response)) {
                cacheRecord(this.cache, response.data)
                resolve(response.data)
              } else {
                reject(response.statusText)
              }
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }

  deleteRecord (record) {
    return new Pledge((resolve, reject) => {
      if (!record) {
        reject(new Error('record is required'))
      }

      if (record instanceof Object) {
        record = record.id
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .delete(`/dns_zones/${zoneId}/dns_records/${record}`)
            .then(response => {
              if (isValidResponse(response)) {
                resolve(response.data)
              } else {
                reject(response.statusText)
              }
            })
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }
}
