
# AWS Netlify Let's Encrypt SSL Renewal
> Standalone and Lambda compatible tool for obtaining and renewing Let's Encrypt SSL certificates for Netlify managed domains

[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/Flet/semistandard) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/843d0c2b738f4048a7c0a82e52dffe98)](https://www.codacy.com/app/jyksnw/aws-netlify-letsencrypt?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=jyksnw/aws-netlify-letsencrypt&amp;utm_campaign=Badge_Grade) [![Known Vulnerabilities](https://snyk.io/test/github/jyksnw/aws-netlify-letsencrypt/badge.svg)](https://snyk.io/test/github/jyksnw/aws-netlify-letsencrypt)

This project was created as a means to easily obtain and renew Let's Encrypt SSL certificates for various AWS service endpoints where DNS ALIAS records are managed by a Netlify DNS Zone.

## Developing

### Built With
+ Node.js v6.10
+ Serverless v1.26.1

### Prerequisites
[AWS Command Line Interface](https://aws.amazon.com/cli/)

+ A user should be created with at least the following permissions:
  + AmazonS3FullAccess
  + AWSCertificateManagerFullAccess

```shell
pip install awscli

# on MacOS

brew install awscli

# Configure AWS with a valid set of credentials
aws configure
```


[Serverless](https://serverless.com/)
```shell
npm i serverless -g

serverless login
```


### Setting up Dev

To get setup for development you should ensure that the [AWS Command Line Interface](https://aws.amazon.com/cli/) has been installed and configured.

```shell
git clone https://github.com/jyksnw/aws-netlify-letsencrypt.git
cd aws-netlify-letsencrypt/
yarn install
```

### Building

If your project needs some additional steps for the developer to build the
project after some code changes, state them here. for example:

```shell
./configure
make
make install
```

Here again you should state what actually happens when the code above gets
executed.

### Deploying / Publishing
give instructions on how to build and release a new version
In case there's some step you have to take that publishes this project to a
server, this is the right time to state it.

```shell
packagemanager deploy your-project -s server.com -u username -p password
```

And again you'd need to tell what the previous code actually does.

## Versioning

We can maybe use [SemVer](http://semver.org/) for versioning. For the versions available, see the [link to tags on this repository](/tags).


## Configuration

Here you should write what are all of the configurations a user can enter when
using the project.

## Tests

>TBD

## Style guide

[![js-semistandard-style](https://cdn.rawgit.com/flet/semistandard/master/badge.svg)](https://github.com/Flet/semistandard)

## Licensing

MIT
