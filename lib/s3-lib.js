'use strict'
import AWS from 'aws-sdk'
import Pledge from 'bluebird'

export default class Bucket {
  constructor (bucket) {
    AWS.config.setPromisesDependency(Pledge)

    this.s3 = new AWS.S3({region: process.env.AWS_REGION})
    this.bucket = bucket
  }

  getFile (fileName) {
    return new Pledge((resolve, reject) => {
      const params = {
        Bucket: this.bucket,
        Key: fileName
      }

      this.s3.getObject(params)
        .promise()
        .then(data => resolve(data.Body))
        .catch(err => reject(err))
    })
  }

  putFile (fileName, fileData) {
    return new Pledge((resolve, reject) => {
      const params = {
        Bucket: this.bucket,
        Key: fileName,
        Body: fileData
      }

      this.s3.putObject(params)
        .promise()
        .then(url => resolve(url))
        .catch(err => reject(err))
    })
  }
}
