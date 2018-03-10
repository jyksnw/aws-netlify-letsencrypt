
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
mv .yaml.example .yaml
$EDITOR .yaml
```
The `.yaml` file should be update per the [configuration](#Configuration) section.

### Building

You can build and package as a lambda function be running:

```shell
npm run package
```

This will ensure that all code is formatted correctly and then generates the packaged function files and places them in `.serverless/`

### Deploying / Publishing

You can deploy the serverless function, assuming that you have setup your AWS account and serverless, by running:

```shell
npm run deploy
```

This will ensure that all code is formatted correctly and will then build and deploy the function to AWS.

## Versioning

[SemVer](http://semver.org/) is used for versioning. For the versions available, see the [releases](https://github.com/jyksnw/aws-netlify-letsencrypt/releases).

## Configuration

| Environmental Variable | Use |
| ---------------------- | --- |
| NETLIFY_CLIENT_ID | The [Netlify OAuth Application](https://app.netlify.com/account/applications) Client ID |
| NETLIFY_CLIENT_SECRET | The [Netlify OAuth Application](https://app.netlify.com/account/applications) Secret |
| NETLIFY_DNS_ZONE_NAME | The name of the Netlify DNS Zone |
| AWS_S3_ACME_BUCKET | The name of the S3 bucket used to store generated certificates |
| AWS_SNS_TOPIC | The SNS Topic Arn on which to dispatch the new certificate Arn. This will be set by the serverless deploy for non-local use |
| ACME_EMAIL_ADDRESS | The email address to use for the certificate registration |
| ACME_DOMAIN_NAME | The domain that the SSL certificate is to be issued for. Currently can only be a single domain and must be either the primary domain or a sub-domain of the primary domain |
| ACME_TEST | If set to `true` (default) than the [Let's Encrypt Staging environment](https://letsencrypt.org/docs/staging-environment/) is used. Only set this to `false` once all testing has been completed to avoid having your domain reach it's rate limit |
## Tests

>TBD

## Style guide

[![js-semistandard-style](https://cdn.rawgit.com/flet/semistandard/master/badge.svg)](https://github.com/Flet/semistandard)

## Licensing

MIT
