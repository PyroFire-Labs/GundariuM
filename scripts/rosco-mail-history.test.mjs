import assert from "node:assert/strict";
import test from "node:test";
const core = await import("../src/lib/roscoAutoMailCore.ts");
const task = {id:"target",inboxId:"inbox",threadId:"thread",messageId:"human-2"};
const inbox = {inbox_id:"inbox",email:"rosco@example.test"};
const approved = core.approvedSenders("human@example.test");
const inbound = (id,text,seconds=0) => ({inbox_id:"inbox",thread_id:"thread",message_id:id,from:"human@example.test",labels:["received"],authentication_results:{dkim:"pass",dkim_domain:"example.test"},timestamp:new Date(1_800_000_000_000+seconds*1000).toISOString(),text});
const first = inbound("human-1","Remember my preferred color is blue.");
const reply = {...inbound("reply-1","I will keep blue in mind.",1),from:"rosco@example.test",labels:["sent"],headers:{"Auto-Submitted":"auto-replied"}};
const target = inbound("human-2","Which color did I mention?",2);
const page = (messages,extra={})=>({inbox_id:"inbox",thread_id:"thread",message_count:3,last_message_id:"human-2",count:messages.length,messages,...extra});
const build = pages => core.buildThreadHistory(task,inbox,target,approved,pages,"reply-1");

test("complete paginated provider history includes inbound and prior replies chronologically",()=>{
 const context=JSON.parse(build([page([reply,target],{next_page_token:"older"}),page([first])]));
 assert.equal(context.complete,true);assert.equal(context.target_message_id,"human-2");
 assert.deepEqual(context.messages.map(m=>m.message_id),["human-1","reply-1","human-2"]);
 assert.deepEqual(context.messages.map(m=>m.direction),["inbound","outbound","inbound"]);
 assert.equal(context.messages[1].text,reply.text);
});
test("history rejects incomplete, changed, mixed-inbox and mixed-thread snapshots",()=>{
 for(const pages of [[],[page([target])],[page([first,reply,target],{next_page_token:"more"})],[page([first,reply,target],{thread_id:"other"})],[page([first,reply,{...target,inbox_id:"other"}])],[page([first,reply,{...target,thread_id:"other"}])],[page([reply,target]),page([first],{message_count:4})]]) assert.throws(()=>build(pages),core.HistoryReviewError);
});
test("missing prior reply, invalid content, duplicate IDs and oversized history require review",()=>{
 for(const messages of [[first,target], [first,{...reply,text:undefined,html:"<p>only html</p>"},target], [first,{...reply,attachments:[{}]},target], [first,reply,{...target,text:"x".repeat(12001)}], [first,first,target], [first,reply,{...target,timestamp:"bad"}]]) assert.throws(()=>build([page(messages)]),core.HistoryReviewError);
});
test("unapproved or automated historical inbound content never enters model context",()=>{
 for(const unsafe of [{...first,from:"other@example.test"},{...first,headers:{"Auto-Submitted":"auto-replied"}},{...first,authentication_results:{}}]) assert.throws(()=>build([page([unsafe,reply,target])]),core.HistoryReviewError);
});
test("thread transport follows documented older-page tokens and rejects repeated tokens",async()=>{
 const urls=[];const pages=[page([reply,target],{next_page_token:"older/token"}),page([first])];
 const transport=core.createAutoMailTransport("synthetic",async url=>{urls.push(String(url));return Response.json(pages.shift());});
 const result=await transport.fetchHistory(task,inbox,target,approved,"reply-1");
 assert.equal(JSON.parse(result).messages.length,3);
 assert.equal(new URL(urls[0]).pathname,"/v0/inboxes/inbox/threads/thread");
 assert.equal(new URL(urls[1]).searchParams.get("page_token"),"older/token");
 const repeated=core.createAutoMailTransport("synthetic",async()=>Response.json(page([target],{next_page_token:"same"})));
 await assert.rejects(repeated.fetchHistory(task,inbox,target,approved),core.HistoryReviewError);
});

test("history bounds and malformed provider responses require explicit review",async()=>{
 assert.throws(()=>build([page([first,reply,target],{message_count:31})]),core.HistoryReviewError);
 assert.throws(()=>build([page([{...first,text:'x'.repeat(12000)},{...reply,text:'y'.repeat(12000)},target])]),core.HistoryReviewError);
 for(const response of [()=>new Response('{bad json'),()=>Response.json(page([first,reply,{...target,html:'x'.repeat(256001)}])),()=>new Response(null)]){
  const transport=core.createAutoMailTransport('synthetic',async()=>response());
  await assert.rejects(transport.fetchHistory(task,inbox,target,approved),core.HistoryReviewError);
 }
});
