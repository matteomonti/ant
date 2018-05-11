const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const path = require('path');
const dockerode = require('dockerode');
const chalk = require('chalk');

const repository = require('./repository');

const docker = new dockerode();

async function dockerfile(root)
{
    try
    {
        await fs.mkdirAsync(path.join(root, '.ant', 'docker'));
    }
    catch(_){}

    var environment = await repository.configuration.environment(root);

    var body = 'FROM rainvg/ant\n\n';

    for(var index = 0; index < environment.length; index++)
    {
        var dependency = environment[index];

        var deppath = path.join(__dirname, '..', 'docker', 'environment', dependency);

        var dockerfile = await fs.readFileAsync(path.join(deppath, 'Dockerfile'));
        body += dockerfile.toString() + '\n';

        var source = path.join(deppath, dependency + '.sh');
        var dest = path.join(root, '.ant', 'docker', dependency + '.sh');

        await fs.writeFileAsync(dest, await fs.readFileAsync(source));
    };

    await fs.writeFileAsync(path.join(root, '.ant', 'docker', 'Dockerfile'), body);
}

async function build(root)
{
    var identifier = await repository.identifier(root);
    var tag = 'ant-' + identifier;

    var configuration = {last_modified: await repository.configuration.last_modified(root)};

    var images = await docker.listImages();

    var result = {found: false, remove: false};

    images.forEach(async function(image)
    {
        if(result.found || result.remove)
            return;

        image.RepoTags.forEach(function(repotag)
        {
            if(repotag.split(':')[0] == tag)
            {
                var creation_date = new Date(image.Created * 1000);

                if(creation_date < configuration.last_modified)
                    result.remove = true;
                else
                    result.found = true;
            }
        });
    });

    if(result.remove)
        await docker.getImage(tag).remove();

    if(!(result.found))
    {
        console.log(chalk.red('No Docker image found for ant.json, building it from scratch.'));
        await dockerfile(root);

        await docker.buildImage({context: path.join(root, '.ant', 'docker')}, {t: tag}, function(err, stream)
        {
            console.log(chalk.yellow("Building Docker image.."));

            if(err)
                console.log(chalk.red("Failed to build image:", err));
            else
            {
                stream.on('data', function(chunk)
                {
                    chunk.toString().split("\n").forEach(function(message)
                    {
                        try
                        {
                            message = JSON.parse(message).stream.replace(/\r?\n|\r/g, "");

                            if(message.length)
                                console.log(message);
                        }
                        catch(error)
                        {
                            message = message.replace(/\r?\n|\r/g, "")

                            if(message.length)
                                console.log(message)
                        }
                    });
                });

                stream.on('end', function()
                {
                    console.log(chalk.green("Docker image successfully built."));
                });
            }
        });
    }
}

module.exports = {
    build: build
};
