'use strict'
import AWS from 'aws-sdk'
import Pledge from 'bluebird'

export default class Table {
  constructor (table) {
    AWS.config.setPromisesDependency(Pledge)

    this.db = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_REGION})
    this.table = table
  }

  putItem (item) {
    return new Pledge((resolve, reject) => {
      if (!(item instanceof Object)) {
        reject(new Error('item must be an object'))
      }

      if (!item.id) {
        reject(new Error('item must contain an id'))
      }

      const params = {
        TableName: this.table,
        Item: item
      }

      this.db.put(params)
        .promise()
        .then(response => resolve(response))
        .catch(err => reject(err))
    })
  }

  getItem (key) {
    return new Pledge((resolve, reject) => {
      const params = {
        TableName: this.table,
        Key: {
          id: key
        }
      }

      this.db.get(params)
        .promise()
        .then(results => resolve(results))
        .catch(err => reject(err))
    })
  }

  getItems () {
    return new Pledge((resolve, reject) => {
      const params = {
        TableName: this.table
      }

      this.db.scan(params)
        .promise()
        .then(results => resolve(results))
        .catch(err => reject(err))
    })
  }

  deleteItem (item) {
    return new Pledge((resolve, reject) => {
      if (item instanceof Object) {
        item = item.id
      }

      const params = {
        TableName: this.table,
        Key: {
          id: item
        }
      }

      this.db.delete(params)
        .promise()
        .then(results => resolve(results))
        .catch(err => reject(err))
    })
  }
}
