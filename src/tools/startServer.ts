import { decode } from 'jsonwebtoken';
import { dbconfig } from './../config/ormconfig';
import { createConnection } from 'typeorm';
import User from '../entity/User';
import schemaWithResolvers from './../schema';
import { ApolloServer } from 'apollo-server';

export async function startServer(port: number) {
    const schema = schemaWithResolvers;
    const server = new ApolloServer({
        cors: true,
        schema,
        introspection: true,
        playground: true,
        context: async ({ req, connection }) => {
            if (connection) {
                return connection.context;
            } else {
                const token = req.headers.authorization || "";
                const user = await getUser(token);
                return { user };
            }
        },
        subscriptions: {
            path: '/subscriptions',
            keepAlive: 30000,
            onConnect: async (connectionParams: any) => {
                const user = await getUser(connectionParams.authorization || '');
                if (!user)
                    return false;
                return { user };
            },
        },
    });
    await connectDB();

    server
        .listen(process.env.PORT || port)
        .then(({ url, subscriptionsUrl }) => {
            console.log(`url_server is connected at: ${url}`);
            console.log(`subscription_server is connected at: ${subscriptionsUrl}`);
        });
}

const getUser = async (jwt: string) => {
    const userId = decode(jwt);
    if (!userId) return null;
    //@ts-ignore
    const user = await User.findOne({ where: { id: userId.id } });
    return user;
};

const connectDB = async () => {
    let retry = 10;
    while (retry !== 0) {
        try {
            await createConnection(dbconfig);
            console.log('database connected');
            break;
        } catch (e) {
            retry--;
            console.log('---\n' + e + '\n---');
            console.log(`${retry} retries remaining`);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};
