const bluebird = require('bluebird');
const os = require('os');
const path = require('path');
const fs = bluebird.promisifyAll(require('fs'));

const docker = require('./docker.js');

async function preprocess(container, root, filename)
{
    return new Promise(async function(resolve, reject)
    {
        container.exec({Cmd: ['clang++-6.0', '-std=c++2a', '-stdlib=libc++', '-Wno-deprecated', '-E', '-P', path.join('/repository', filename), '-o', path.join('/repository', '.ant', 'output')], AttachStdout: true, AttachStderr: true}, function(err, exec)
        {
            if(err)
                return reject(err);

            exec.start(function(err, stream)
            {
                if(err)
                    return reject(err);

                container.modem.demuxStream(stream, process.stdout, process.stderr);

                var loop = function()
                {
                    exec.inspect(async function(err, inspect)
                    {
                        if(err)
                            reject(err);

                        if(inspect.ExitCode === null)
                            return setTimeout(loop, 50);

                        if(!(inspect.ExitCode))
                        {
                            var output = await fs.readFileAsync(path.join(root, '.ant', 'output'));
                            await fs.unlinkAsync(path.join(root, '.ant', 'output'));

                            resolve(output.toString());
                        }
                        else
                            reject('Non-zero exit error.');
                    });
                }

                loop();
            });
        });
    });
}

async function parse(container, root, filename)
{
    var result = {};
    var err = null;

    var code = await preprocess(container, root, filename);

    (code.match(/(export\s+)?module\s+([a-zA-Z]([\w\.]*))\s*;/g) || []).forEach(function(statement)
    {
        if(result.module)
            err = "Multiple module declarations found.";

        result.module = statement.replace('export', '').replace('module', '').replace(';', '').replace(/\s*/g, '');
        result.interface = (statement.indexOf('export') > -1);
    });

    if(err)
        throw err;

    if(!(result.module))
        throw "No module declaration found.";

    result.dependencies = [];
    (code.match(/import\s+([a-zA-Z]([\w\.]*))\s*;/g) || []).forEach(function(statement)
    {
        result.dependencies.push(statement.replace('import', '').replace(';', '').replace(/\s*/g, ''));
    });

    return result;
}

function parser(container, root)
{
    // Self

    var self = this;

    // Methods

    self.parse = function(filename)
    {
        return parse(container, root, filename);
    }
};

module.exports = async function(root)
{
    var container = await docker.start(root, 'dev');
    return new parser(container, root);
};
