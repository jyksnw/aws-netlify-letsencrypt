'use strict'
import NetlifyClient from './netlify-lib'
import resolveTxt from './dns-lib'

const TOKEN = '1b60580738885aa3fdd1d8d7a7c024b34de46e1580d68732da71cf6d19061fd9'
const DOMAIN = 'jyksnw.xyz'

const netlify = new NetlifyClient(TOKEN, DOMAIN)

// netlify.createRecord({
//   hostname: '_a-test.' + DOMAIN,
//   type: 'TXT',
//   value: 'this is a test',
//   ttl: 30
// })
//   .then(record => resolveTxt(record.hostname, 30000))
//   .then(data => netlify.deleteRecord())
//   .finally(() => console.log('finished'))

netlify.getRecords()
  .then(() => {
    console.log('PREFETCH COMPLETE\n\n\n')
    return netlify.getRecordsByHostname(DOMAIN, false)
  })
  .then(console.log)
  .catch(console.log)
