require('./handler').renew_certificate(null, null, (err, status) => {
  if (err) {
    console.log(err, status);
  } else {
    console.log(status);
  }
});
