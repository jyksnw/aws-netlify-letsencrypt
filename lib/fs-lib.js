'use strict'
import fs from 'fs'
import Pledge from 'bluebird'

export default class File {
  static exists (file) {
    return new Pledge((resolve, reject) => {
      fs.stat(file, (err, stats) => {
        if (err) {
          if (err.code === 'ENOENT') {
            return resolve(false)
          } else {
            return reject(err)
          }
        }

        return resolve(stats.isFile() || stats.isDirectory())
      })
    })
  }

  static delete (file) {
    return new Pledge((resolve, reject) => {
      File.exists(file)
        .then(exists => {
          if (exists) {
            fs.unlink(file, err => {
              if (err) {
                return reject(err)
              }

              return resolve()
            })
          }

          return resolve()
        })
        .catch(err => reject(err))
    })
  }

  static read (file) {
    return new Pledge((resolve, reject) => {
      File.exists(file)
        .then(exists => {
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
              return reject(err)
            }

            return resolve(data)
          })
        })
        .catch(err => reject(err))
    })
  }

  static write (file, data) {
    return new Pledge((resolve, reject) => {
      fs.writeFile(file, data, 'utf8', err => {
        if (err) {
          return reject(err)
        }

        return resolve()
      })
    })
  }

  static mkdir (dir) {
    return new Pledge((resolve, reject) => {
      File.exists(dir)
        .then(exists => {
          if (exists) {
            return resolve()
          }

          fs.mkdir(dir, err => {
            if (err) {
              return reject(err)
            }

            return resolve()
          })
        })
        .catch(err => reject(err))
    })
  }

  static rmdir (dir) {
    return new Pledge((resolve, reject) => {
      File.exists(dir)
        .then(exists => {
          if (!exists) {
            return resolve()
          }

          fs.rmdir(dir, err => {
            if (err) {
              return reject(err)
            }

            return resolve()
          })
        })
    })
  }
}
