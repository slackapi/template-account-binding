const os = require('os');
const pkg = require('../package.json');

exports.packageIdentifier = () => `${pkg.name.replace('/', ':')}/${pkg.version} ${os.platform()}/${os.release()} node/${process.version.replace('v', '')}`;
