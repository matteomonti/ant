const os = require('os');
const path = require('path');

const repository = require('./repository.js');
const docker = require('./docker.js');

(async function()
{
    await docker.build(path.join(os.homedir(), 'anttest'));
})()
