const { db } = require('../init');

exports.up = async function (knex) {
    const exists = await knex.schema.hasTable('system_settings');
    if (!exists) {
        await knex.schema.createTable('system_settings', (table) => {
            table.string('key').primary();
            table.text('value');
            table.string('description');
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
        console.log('✅ Tabela system_settings criada!');

        // Insert default email settings placeholders if needed, or leave empty
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('system_settings');
};
