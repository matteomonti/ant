const os = require('os');
const path = require('path');

const repository = require('./repository.js');
const docker = require('./docker.js');
const parser = require('./parser.js');

(async function()
{
    console.log(await parser.parse(path.join(os.homedir(), 'anttest'), 'src/test.h'));
})()
