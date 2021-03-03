import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { addResolversToSchema } from '@graphql-tools/schema';
import { join } from 'path';
import User from '../entity/User';
import chatResolver from './resolvers/chatResolvers';
import messageResolver from './resolvers/messageResolvers';
import userResolver from './resolvers/userResolvers';
import followResolver from './resolvers/followResolvers';
import postResolver from './resolvers/postResolvers';
import likeResolver from './resolvers/likeResolvers';
import commentResolver from './resolvers/commentResolvers';
import { RedisPubSub } from 'graphql-redis-subscriptions';

const schema = loadSchemaSync(join(__dirname, './typeDefs.graphql'), { loaders: [new GraphQLFileLoader()] });

const resolvers = {
    Query: {
        ...chatResolver.Query,
        ...userResolver.Query,
        ...messageResolver.Query,
        ...followResolver.Query,
        ...postResolver.Query,
        ...likeResolver.Query,
        ...commentResolver.Query,
    },
    Mutation: {
        ...chatResolver.Mutation,
        ...userResolver.Mutation,
        ...messageResolver.Mutation,
        ...followResolver.Mutation,
        ...postResolver.Mutation,
        ...likeResolver.Mutation,
        ...commentResolver.Mutation,
    },
    Subscription: {
        ...messageResolver.Subscription,
        ...commentResolver.Subscription,
        ...likeResolver.Subscription,
        ...followResolver.Subscription,
    },
};

export type contextType = {
    user: User;
};

const schemaWithResolvers = addResolversToSchema({
    schema,
    resolvers,
});

function getPubSub() {
    if (process.env.REDIS_DOMAIN_NAME && process.env.REDIS_NUMBER && process.env.REDIS_PASSWORD) {
        return new RedisPubSub({
            connection: {
                host: process.env.REDIS_DOMAIN_NAME,
                port: Number(process.env.REDIS_NUMBER),
                password: process.env.REDIS_PASSWORD,
                retryStrategy: times => Math.min(times * 50, 2000),
            }
        });
    }
    return new RedisPubSub();
}

export default schemaWithResolvers;

export const pubSub = getPubSub();