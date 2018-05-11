const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const path = require('path');
const randomstring = require('randomstring');

async function identifier(root)
{
    var configuration = await fs.readFileAsync(path.join(root, 'ant.json'));
    configuration = JSON.parse(configuration);

    try
    {
        await fs.statAsync(path.join(root, '.ant'));
    }
    catch(_)
    {
        fs.mkdirAsync(path.join(root, '.ant'));
    }

    try
    {
        return (await fs.readFileAsync(path.join(root, '.ant', 'identifier'))).toString();
    }
    catch(_)
    {
        var identifier = randomstring.generate({length: 6, charset: 'alphanumeric', capitalization: 'lowercase'});
        await fs.writeFileAsync(path.join(root, '.ant', 'identifier'), identifier);
        return identifier;
    }
}

var configuration = {
    last_modified: async function(root)
    {
        return (await fs.statAsync(path.join(root, "ant.json"))).mtime;
    },
    environment: async function(root)
    {
        return JSON.parse(await fs.readFileAsync(path.join(root, "ant.json"))).environment || [];
    }
}

module.exports = {
    identifier: identifier,
    configuration: configuration
};
