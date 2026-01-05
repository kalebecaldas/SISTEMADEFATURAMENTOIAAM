const path = require('path');
require('dotenv').config();

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: path.join(__dirname, 'database/sistema_faturamento.db')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'database/migrations')
        },
        seeds: {
            directory: path.join(__dirname, 'database/seeds')
        }
    },

    production: {
        client: 'pg',
        connection: process.env.DATABASE_URL + '?sslmode=require',
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: path.join(__dirname, 'database/migrations')
        },
        seeds: {
            directory: path.join(__dirname, 'database/seeds')
        }
    }
};
