const { db } = require('./database/init');
const bcrypt = require('bcryptjs');

const createAdmin = async () => {
    try {
        const email = 'kalebe.caldas@hotmail.com';
        const senha = 'mxskqgltne';
        const nome = 'Kalebe Caldas';

        const senhaHash = await bcrypt.hash(senha, 10);

        // Check if user exists
        const existingUser = await db('usuarios').where({ email }).first();

        if (existingUser) {
            console.log('User already exists. Updating...');
            await db('usuarios')
                .where({ email })
                .update({
                    senha: senhaHash,
                    tipo: 'admin',
                    nome: nome,
                    ativo: true
                });
        } else {
            console.log('Creating new admin user...');
            await db('usuarios').insert({
                email,
                senha: senhaHash,
                nome,
                tipo: 'admin',
                ativo: true
            });
        }

        console.log('Admin user created/updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin();
