'use strict'
import axios from 'axios'
import Pledge from 'bluebird'

const cache = []

const isValidResponse = function (response) {
  return new Pledge((resolve, reject) => {
    if (response &&
      response.status &&
      (response.status >= 200 && response.status < 300)) {
      cacheRecord(response.data)
        .finally(() => resolve(response.data))
    } else {
      reject(response.statusText)
    }
  })
}

const isDnsRecord = function (record) {
  return new Pledge(resolve => {
    if (record instanceof Array) {
      return resolve(false)
    }

    if (!record) {
      return resolve(false)
    }

    return resolve((record.ttl !== undefined || record.hostname !== undefined))
  })
}

const cacheRecord = function (record) {
  return new Pledge(resolve => {
    if (record instanceof Array) {
      return resolve(Pledge.all(record.map(r => cacheRecord(r))))
    } else {
      isDnsRecord(record)
        .then(isDnsRecord => {
          if (isDnsRecord) {
            const r = cache.find(rec => rec.id === record.id)
            if (r === undefined) {
              cache.push(record)
            }
          }

          return resolve()
        })
    }
  })
}

export default class NetlifyClient {
  constructor (token, zoneName) {
    this.token = token
    this.zoneName = zoneName
    this.zoneId = null

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
        .then(response => isValidResponse(response))
        .then(record => {
          this.zoneId = record.find(zone => zone.name === this.zoneName).id

          if (this.zoneId !== undefined) {
            resolve(this.zoneId)
          } else {
            reject(new Error(`Could not find zone for ${this.zoneName}`))
          }
        })
        .catch(err => reject(err))
    })
  }

  getRecords (force = false) {
    return new Pledge((resolve, reject) => {
      if (!force && cache.length > 0) {
        resolve(cache)
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .get(`/dns_zones/${zoneId}/dns_records`)
            .then(response => isValidResponse(response))
            .then(records => resolve(records))
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

      if (!force) {
        const r = cache.find(r => r.id === record)
        if (r !== undefined) {
          return resolve(r)
        }
      }

      this.getZone()
        .then(zoneId => {
          this.client
            .get(`/dns_zones/${zoneId}/dns_records/${record}`)
            .then(response => isValidResponse(response))
            .then(record => resolve(record))
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }

  getRecordsByHostname (hostname, force = false) {
    return new Pledge((resolve, reject) => {
      if (!force) {
        const records = cache.filter(r => r.hostname === hostname)
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
            .then(response => isValidResponse(response))
            .then(record => resolve(record))
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
            .then(response => isValidResponse(response))
            .then(() => resolve())
            .catch(err => reject(err))
        })
        .catch(err => reject(err))
    })
  }
}
