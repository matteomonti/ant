const os = require('os');
const path = require('path');

const repository = require('./repository.js');
const docker = require('./docker.js');
const parser = require('./parser.js');
const database = require('./database.js');

(async function()
{
    var my_parser = await parser(path.join(os.homedir(), 'anttest'));
    var my_database = await database(path.join(os.homedir(), 'anttest'));

    // await my_database.set(await my_parser.parse('src/test.h'));

    await my_database.each.filename(function(filename)
    {
        console.log(filename);
    });

    console.log('All done.');
})()
