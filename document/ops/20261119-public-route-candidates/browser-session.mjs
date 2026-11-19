export async function getTask(){
 const fs=await import('node:fs/promises');
 const file='C:/20.HDev/boxcycle/tmp/public-route-review-session.json';
 let id=19;try{id=JSON.parse(await fs.readFile(file,'utf8')).id;}catch{}
 const entry=(await listTaskSpaces()).find(s=>s.id===id);
 const task=!entry?await taskSpace('Spinatlas public route validation 20261119'):
  entry.ownership==='user'?await claimTaskSpace(id):
  entry.ownership==='agentDelegatedToUser'?await takeOverTaskSpace(id):await taskSpace(id);
 await fs.writeFile(file,JSON.stringify({id:task.spaceId}));
 console.log({space:task.spaceId});return task;
}
