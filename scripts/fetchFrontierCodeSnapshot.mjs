import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile, atomicWriteJson, fetchSource, sha256, timestampForPath } from './sourceSnapshotUtils.mjs';
import { FRONTIER_CODE_API_URL, validateFrontierCodePayload } from './frontierCodeSnapshotUtils.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath=path.resolve(process.env.FRONTIERCODE_SNAPSHOT_OUTPUT
  ?? path.join(root,'src','data','frontierCodeSourceSnapshot.json'));
const rawDirectory=path.resolve(process.env.FRONTIERCODE_RAW_SNAPSHOT_DIR
  ?? path.join(root,'.cache','frontiercode'));
const response=await fetchSource(FRONTIER_CODE_API_URL, {accept:'application/json'});
const rows=validateFrontierCodePayload(JSON.parse(response.body));
const fetchedAt=new Date().toISOString();
const rawPath=path.join(rawDirectory,timestampForPath(new Date(fetchedAt))+'.json');
atomicWriteFile(rawPath,response.body);
atomicWriteJson(outputPath,{
  schemaVersion:'frontiercode-source-snapshot/v1',fetchedAt,revision:'1.1',dataset:'main',taskCount:100,
  source:{url:FRONTIER_CODE_API_URL,leaderboardUrl:'https://cognition.com/frontiercode',sha256:sha256(response.body),rawSnapshotFile:path.relative(root,rawPath)},rows,
});
console.log(JSON.stringify({status:'VALIDATED_FRONTIERCODE_SNAPSHOT',models:new Set(rows.map(r=>r.name)).size,rows:rows.length}));
