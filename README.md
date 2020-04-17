This tool allows to execute various operations on uuCloud using CLI.

# How to install and update ?

## Linux and MacOS
`npm install --registry "https://repo.plus4u.net/repository/npm/" -g $(npm v --registry http://registry.npmjs.com uucloud-cli dist.tarball)`

## Windows

1. `npm v --registry http://registry.npmjs.com uucloud-cli dist.tarball)`
2. `npm install --registry "https://repo.plus4u.net/repository/npm/" -g {archive url from previous command}`

# How to use ?

- `uucloud --help`
- `uucloud use --help`
- `uucloud ps --help`
- `uucloud logs --help`

# How to use not default uuCloud ?

If you have dedicated deployment of uuCloud you must use different uri to access deployment list and logs.

Current version of uucloud-cli supports only specification of different uri for logs via option `log-store-uri` (see help for more information). 
For example:

`uucloud logs -a browser --log-store-uri="https://libra-sys-ei.plus4u.net/uu-logstore/" -n "ues:DTC-BT[99923616732520257]:LIBRA_DATAFLOW[5c5d4bdce1ada19aba86fdbd]:USY.LIBRAG01.CONFIGURATION[5c5d4efde1ada1405d86fe42]"`

# How to use presents ? 

   

# How to develop ?

Publish to npmjs: 

`npm publish --registry http://registry.npmjs.com`
