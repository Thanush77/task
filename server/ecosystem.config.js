module.exports = {
    apps: [{
        name: 'taskflow-server',
        script: 'server.js',
        instances: 'max',
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            PORT: 3000
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }],

    deploy: {
        production: {
            user: 'node',
            host: 'your-server.com',
            ref: 'origin/master',
            repo: 'git@github.com:yourusername/taskflow-server.git',
            path: '/var/www/taskflow',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        }
    }
};