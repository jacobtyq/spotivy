import SpotifyWebApi from 'spotify-web-api-node';
import highland from 'highland';

import { debug } from './log';

export {
  login,
  getTrack,
  getPlaylist,
  getAllUserPlaylists,
  getAllPlaylistTracks
};

let api = undefined;

function login(clientId, clientSecret, { logger } = { logger: undefined }) {
  return new Promise(function (resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

    debug(logger, `Spotify login`);

    api = new SpotifyWebApi({ clientId, clientSecret });

    // Retrieve an access token.
    api.clientCredentialsGrant()
      .then(function (data) {
        // Save the access token so that it's used in future calls
        api.setAccessToken(data.body['access_token']);

        resolve(api);
      }, function (err) {
        console.error('Something went wrong when retrieving an access token', err);
        reject(err);
      });
  });
}

function getTrack(trackId, { logger } = { logger: undefined }) {
  return api.getTrack(trackId).then(r => r.body);
}

function getPlaylist(username, playlistId, { logger } = { logger: undefined }) {
  return api.getPlaylist(username, playlistId).then(r => r.body);
}

function getAllUserPlaylists(username, { logger } = { logger: undefined }): any {
  debug(logger, `Fetching playlists of ${username}`);
  return createPaginationStream(function getPlaylistTracks(options) {
    return api.getUserPlaylists(username, options);
  }, { logger });
}

function getAllPlaylistTracks(username, playlistId, { logger } = { logger: undefined }): any {
  debug(logger, `Fetching playlist tracks (${playlistId})`);
  return createPaginationStream(function getPlaylistTracks(options) {
    return api.getPlaylistTracks(username, playlistId, options);
  }, { logger });
}

function createPaginationStream(endpointFn, { logger } = { logger: undefined }) {
  let offset = 0;
  const limit = 20;
  let totalItemsCount = undefined;
  let loadedItemsCount = 0;

  return highland(function (push, next) {
    if (loadedItemsCount === 0)
      debug(logger, `Fetch paginated: "${endpointFn.name}"`);
    debug(logger, `Fetch paginated: loading ${offset}..${offset + limit}`);

    endpointFn({ limit, offset })
      .then(data => {
        offset += limit;
        totalItemsCount = data.body.total;
        loadedItemsCount += data.body.items.length;

        debug(logger, `Fetch paginated: loaded  ${loadedItemsCount}/${totalItemsCount}`);
        debug(logger, `Fetch paginated: pushing down the stream`);

        // put the items down to the stream
        push(null, data.body.items);

        if (loadedItemsCount >= totalItemsCount) {
          debug(logger, `Fetch paginated: all finish`);
          push(null, highland.nil);
        } else {
          debug(logger, `Fetch paginated: next page`);
          next();
        }
      })
      .catch(err => push(err));
  });
}
