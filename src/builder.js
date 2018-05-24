const bluebird = require('bluebird');
const path = require('path');
const os = require('os');
const fs = bluebird.promisifyAll(require('fs'));
const chalk = require('chalk');

const docker = require('./docker.js');
const parser = require('./parser.js');
const database = require('./database.js');

var walk = async function(root, since, callback)
{
    await (async function recursion(dir)
    {
        var files = await fs.readdirAsync(dir);

        for(var index = 0; index < files.length; index++)
        {
            var file = files[index];
            if(file == '.ant' || file == 'ant.json')
                continue;

            var stat = await fs.statAsync(path.join(dir, file));

            if(stat.isDirectory())
                await recursion(path.join(dir, file));
            else if(stat.mtime >= since)
                await callback(path.relative(root, path.join(dir, file)));
        }
    })(root);
};

function builder(container, root, parser, database)
{
    // Self

    var self = this;

    // Methods

    self.index = async function()
    {
        var last_run = new Date(await database.last_run());

        await database.each.filename(async function(filename)
        {
            try
            {
                await fs.statAsync(path.join(root, filename));
            }
            catch(_)
            {
                await database.remove(filename);
            }
        });

        await walk(root, last_run, async function(file)
        {
            if(file.endsWith('.h') || file.endsWith('.hpp') || file.endsWith('.cpp'))
                await database.set(await parser.parse(file));
        });

        await database.refresh();
    };

    self.build = async function()
    {
        await self.index();
        var errors = await database.errors();

        if(errors.length != 0)
        {
            console.log(chalk.yellow('Dependency sanity check failed:'))

            errors.forEach(function(error)
            {
                switch(error.type)
                {
                    case 'no-interface':
                        console.log(chalk.red(' - This module has no interface:', error.module));
                        break;
                    case 'multiple-interfaces':
                        console.log(chalk.red(' - This module has multiple interfaces:', error.module));
                        break;
                    case 'missing-dependency':
                        console.log(chalk.red(' - This file depends on a non-existing module:', error.file, '->', error.module));
                        break;
                    case 'cyclic-dependency':
                        console.log(chalk.red(' - These modules are cyclically dependent:', error.cycle.concat([error.cycle[0]]).join(' -> ')));
                        break;
                }
            });

            return;
        }

        await database.last_run.set(new Date());
    }
};

module.exports = async function(root)
{
    return new builder(await docker.start(root, 'dev'), root, await parser(root), await database(root));
};
