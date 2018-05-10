const os = require('os');
const path = require('path');

const repository = require('./repository.js');
const docker = require('./docker.js');

(async function()
{
    console.log(await repository.identifier(path.join(os.homedir(), 'anttest')));
})()
