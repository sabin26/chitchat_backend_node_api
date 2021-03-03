import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { addResolversToSchema } from '@graphql-tools/schema';
import { join } from 'path';
import User from '../entity/User';

const schema = loadSchemaSync(join(__dirname, './typeDefs.graphql'), { loaders: [new GraphQLFileLoader()] });

const resolvers = {
    Query: {
    },
    Mutation: {
    },
    Subscription: {
    },
};

export type contextType = {
    user: User;
};

const schemaWithResolvers = addResolversToSchema({
    schema,
    resolvers,
});

export default schemaWithResolvers;