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
        var identifier = randomstring.generate();
        await fs.writeFileAsync(path.join(root, '.ant', 'identifier'), identifier);
        return identifier;
    }
}

module.exports = {
    identifier: identifier
};
