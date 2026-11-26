import test from 'node:test';import assert from 'node:assert/strict';
import {portfolioSchema,portfolioMetrics,type PortfolioRow} from './portfolio.ts';
const candidate={id:crypto.randomUUID(),revision:0,client:'Cliente de prueba',product:'Servicio',source:'Referido',contact:'',stage:'quoted' as const,followUp:'2026-11-20',nextAction:'Confirmar alcance',quote:{reference:'Q-1',amount:'140.25',currency:'USD',validUntil:'2026-11-24'},evidence:''};
test('quote and follow-up require full, bounded evidence; closure cannot be recorded without evidence',()=>{
 assert.equal(portfolioSchema.safeParse(candidate).success,true);
 for(const row of [{...candidate,stage:'won'},{...candidate,quote:null},{...candidate,followUp:''},{...candidate,quote:{...candidate.quote,validUntil:'2026-02-31'}},{...candidate,organization_id:'org_other'}])assert.equal(portfolioSchema.safeParse(row).success,false);
});
test('expired quote and due follow-up counts exclude closed cases and do not infer money',()=>{
 const {id,revision,...payload}=candidate;
 const row:PortfolioRow={id,revision,stage:'quoted',payload,created_at:'',updated_at:''};
 const result=portfolioMetrics([row,{...row,stage:'won'}],'2026-11-26');
 assert.equal(result.due,1);assert.equal(result.staleQuotes,1);assert.equal(result.registeredWinRate,1);assert.deepEqual(result.stages,{prospect:0,qualified:0,quoted:1,negotiation:0,won:1,lost:0});
});
