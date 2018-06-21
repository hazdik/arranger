import getFields from 'graphql-fields';
import { buildQuery, CONSTANTS as ES_CONSTANTS } from '@arranger/middleware';

export const hitsToEdges = ({ hits, nestedFields, Parallel }) => {
  //Parallel.spawn output has a .then but it's not returning an actual promise
  return new Promise(resolve => {
    new Parallel({ hits, nestedFields })
      .spawn(({ hits, nestedFields }) => {
        /*
          everthing inside spawn is executed in a separate threat, so we have
          to use good old ES5 and require for run-time dependecy bundling.
        */
        const { isObject } = require('lodash');
        return hits.hits.map(x => {
          let joinParent = (parent, field) =>
            parent ? `${parent}.${field}` : field;
          let resolveNested = ({ node, nestedFields, parent = '' }) => {
            if (!isObject(node) || !node) return node;

            return Object.entries(node).reduce((acc, pair) => {
              const field = pair[0];
              const hits = pair[1];
              // TODO: inner hits query if necessary
              const fullPath = joinParent(parent, field);
              const resolvedNested = {};
              resolvedNested[field] = nestedFields.includes(fullPath)
                ? {
                    hits: {
                      edges: hits.map(node => ({
                        node: Object.assign(
                          {},
                          node,
                          resolveNested({
                            node,
                            nestedFields,
                            parent: fullPath,
                          }),
                        ),
                      })),
                      total: hits.length,
                    },
                  }
                : isObject(hits) && hits
                  ? Object.assign(
                      hits.constructor(),
                      resolveNested({
                        node: hits,
                        nestedFields,
                        parent: fullPath,
                      }),
                    )
                  : resolveNested({
                      node: hits,
                      nestedFields,
                      parent: fullPath,
                    });
              return Object.assign({}, acc, resolvedNested);
            }, {});
          };
          let source = x._source;
          let nested_nodes = resolveNested({ node: source, nestedFields });
          return {
            searchAfter: x.sort
              ? x.sort.map(
                  x =>
                    Number.isInteger(x) && !Number.isSafeInteger(x)
                      ? ES_CONSTANTS.ES_MAX_LONG //https://github.com/elastic/elasticsearch-js/issues/662
                      : x,
                )
              : [],
            node: Object.assign({ id: x._id }, source, nested_nodes),
          };
        });
      })
      .then(edges => {
        resolve(edges);
      });
  });
};

export default ({ type, Parallel }) => async (
  obj,
  { first = 10, offset = 0, filters, score, sort, searchAfter },
  { es },
  info,
) => {
  let fields = getFields(info);
  let nestedFields = type.nested_fields;

  let query = filters;

  if (filters || score) {
    // TODO: something with score?
    query = buildQuery({ nestedFields, filters });
  }

  let body =
    (query && {
      query,
    }) ||
    {};

  if (sort && sort.length) {
    // TODO: add query here to sort based on result. https://www.elastic.co/guide/en/elasticsearch/guide/current/nested-sorting.html
    body.sort = sort.map(({ field, missing, order, ...rest }) => {
      const nested_path = nestedFields
        .filter(nestedField => field.indexOf(nestedField) === 0)
        .reduce(
          (deepestPath, path) =>
            deepestPath.length > path.length ? deepestPath : path,
          '',
        );

      return {
        [field]: {
          missing: missing
            ? missing === 'first' ? '_first' : '_last'
            : order === 'asc' ? '_first' : '_last',
          order,
          ...rest,
          ...(nested_path?.length ? { nested: { path: nested_path } } : {}),
        },
      };
    });
  }

  if (searchAfter) {
    body.search_after = searchAfter;
  }

  let { hits } = await es.search({
    index: type.index,
    type: type.es_type,
    size: first,
    from: offset,
    _source: fields.edges && Object.keys(fields.edges.node),
    track_scores: !!score,
    body,
  });

  return {
    edges: () => hitsToEdges({ hits, nestedFields, Parallel }),
    total: () => hits.total,
  };
};
