const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const path = require('path');
const dockerode = require('dockerode');
const chalk = require('chalk');

const repository = require('./repository');

const docker = new dockerode();

async function dockerfile(root, target)
{
    console.log(root, target);

    try
    {
        await fs.mkdirAsync(path.join(root, '.ant', 'docker'));
        await fs.mkdirAsync(path.join(root, '.ant', 'docker', target));
    }
    catch(_){}

    var environment = await repository.configuration.environment(root);

    var body = 'FROM rainvg/ant:dev\n\n';

    for(var index = 0; index < environment.length; index++)
    {
        var dependency = environment[index];

        var deppath = path.join(__dirname, '..', 'docker', 'environment', dependency, target);

        var dockerfile = await fs.readFileAsync(path.join(deppath, 'Dockerfile'));
        body += dockerfile.toString() + '\n';

        var files = await fs.readdirAsync(deppath);

        for(var index = 0; index < files.length; index++)
        {
            var source = path.join(deppath, files[index]);
            var dest = path.join(root, '.ant', 'docker', target, files[index]);

            await fs.writeFileAsync(dest, await fs.readFileAsync(source));
        }
    };

    await fs.writeFileAsync(path.join(root, '.ant', 'docker', target, 'Dockerfile'), body);
}

async function build(root, target)
{
    return new Promise(async function(resolve, reject)
    {
        try
        {
            var identifier = await repository.identifier(root);
            var tag = 'ant:' + identifier;

            var configuration = {last_modified: await repository.configuration.last_modified(root)};

            var images = await docker.listImages();

            var result = {found: false, remove: false};

            images.forEach(async function(image)
            {
                if(result.found || result.remove)
                    return;

                image.RepoTags.forEach(function(repotag)
                {
                    if(repotag.split(':')[1] == identifier)
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

            if(result.found)
                return resolve();

            console.log(chalk.red('No Docker image found for ant.json, building it from scratch.'));
            await dockerfile(root, target);

            docker.buildImage({context: path.join(root, '.ant', 'docker', target)}, {t: tag}, function(err, stream)
            {
                console.log(chalk.yellow('Building Docker image..'));

                if(err)
                    console.log(chalk.red('Failed to build image:', err));
                else
                {
                    stream.on('data', function(chunk)
                    {
                        chunk.toString().split('\n').forEach(function(message)
                        {
                            try
                            {
                                message = JSON.parse(message).stream.replace(/\r?\n|\r/g, '');

                                if(message.length)
                                    console.log(message);
                            }
                            catch(error)
                            {
                                message = message.replace(/\r?\n|\r/g, '')

                                if(message.length)
                                    console.log(message)
                            }
                        });
                    });

                    stream.on('end', function()
                    {
                        console.log(chalk.green('Docker image successfully built.'));
                        resolve();
                    });
                }
            });
        }
        catch(error)
        {
            reject(error);
        }
    });
}

async function start(root, target)
{
    var identifier = await repository.identifier(root);
    var tag = 'ant:' + identifier;
    var container_name = (target == 'dev' ? 'ant-dev' : 'ant-' + identifier);

    await build(root, target);

    var containers = await docker.listContainers({all: true});

    var result = {found: false, remove: false};
    containers.forEach(function(container)
    {
        if(result.found || result.remove)
            return;

        container.Names.forEach(function(name)
        {
            if(name == '/' + container_name)
            {
                if(container.Image == tag && container.State == 'running')
                    result.found = true;
                else
                    result.remove = container.Id;
            }
        });
    });

    if(result.remove)
    {
        try
        {
            await docker.getContainer(result.remove).stop();
        }
        catch(_){}

        try
        {
            await docker.getContainer(result.remove).remove();
        }
        catch(_){}
    }

    if(!(result.found))
    {
        console.log(chalk.red("Builder container not ready, need to boot a new one."));
        var container = await docker.createContainer({Image: tag, Tty: true, name: container_name, HostConfig: {Binds: [root + ':' + '/repository']}});
        await container.start();
        console.log(chalk.green("Builder container started."));
    }
}

module.exports = {
    build: build,
    start: start
};
