const os = require('os');
const path = require('path');

const repository = require('./repository.js');
const docker = require('./docker.js');
const parser = require('./parser.js');

(async function()
{
    var my_parser = await parser(path.join(os.homedir(), 'anttest'));
    console.log(await my_parser.parse('src/test.h'));
})()
