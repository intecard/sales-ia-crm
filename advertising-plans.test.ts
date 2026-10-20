import test from 'node:test';
import assert from 'node:assert/strict';
import { AdvertisingPlans, adPlanSchema, evaluatePerformance, strategy } from './advertising-plans.ts';
const input = { courseTitle: 'Curso de prueba', totalBudgetDop: 1000, dailyLimitDop: 200, durationDays: 7, targetCacDop: 500, channels: ['meta_ads'] as ['meta_ads'] };
const evidence = { spentDop: 1000, paidEnrollments: 5, paidRevenueDop: 12500, attributionVerified: true, complete: true, ageHours: 96, lastIncreaseHours: 25, currentDailyDop: 200, dailyLimitDop: 300, remainingDop: 1000, targetCacDop: 500 };
test('presupuesto mínimo 1000, diario dentro del total y sin campos de tarjeta', () => {
 assert.equal(adPlanSchema.safeParse(input).success, true);
 for (const patch of [{totalBudgetDop:999}, {dailyLimitDop:1001}, {totalBudgetDop:Infinity}, {cvc:'123'}, {cardNumber:'test-only'}, {durationDays:2}]) assert.equal(adPlanSchema.safeParse({...input,...patch}).success,false);
});
test('plan distribuye todo el total sin inventar ventas ni autorizar descuentos', () => {
 const p = strategy(input, {description:'Prueba', investment:'RD$2,500', duration:'5 meses'});
 assert.equal(p.testBudgetDop+p.winnerBudgetDop+p.reserveDop,1000); assert.equal(p.testBudgetDop,200);
 assert.match(p.activation,/no activa gasto/);
});
test('clics, atribución desconocida y datos parciales nunca justifican aumentos', () => {
 for (const patch of [{attributionVerified:false},{paidEnrollments:null},{complete:false},{spentDop:NaN},{paidRevenueDop:NaN}]) assert.equal(evaluatePerformance({...evidence,...patch}).action,'hold');
});
test('aumentos limitados a 20%, saldo y límite diario sin ejecutar gastos', () => {
 assert.equal(evaluatePerformance(evidence).proposedDailyDop,240);
 assert.equal(evaluatePerformance({...evidence, dailyLimitDop:210}).proposedDailyDop,210);
 assert.equal(evaluatePerformance({...evidence, remainingDop:220}).proposedDailyDop,220);
 assert.equal(evaluatePerformance(evidence).applied,false);
});
test('espera suficiente muestra y enfriamiento; recomienda pausa si pierde o agota presupuesto', () => {
 for (const patch of [{paidEnrollments:4},{ageHours:24},{lastIncreaseHours:2},{paidRevenueDop:900}]) assert.equal(evaluatePerformance({...evidence,...patch}).action,'hold');
 for (const patch of [{remainingDop:0},{paidEnrollments:0},{spentDop:3000}]) assert.equal(evaluatePerformance({...evidence,...patch}).action,'pause');
});
test('no se prepara pauta sin plan autorizado, curso correcto y catálogo vigente', async () => {
 const id='00000000-0000-4000-8000-000000000001';
 const row:any={id,state:'draft',payload:input,approved_by:null,catalog_hash:'v1'};
 const plans=new AdvertisingPlans({request:async()=>[row]}, {get:async()=>({hash:'v1'}) as any});
 await assert.rejects(plans.validateCampaign(id,input.courseTitle,'meta_ads',200,100),/AD_PLAN/);
 row.state='approved';row.approved_by='owner';
 await assert.rejects(plans.validateCampaign(id,'Otro curso','meta_ads',200,100),/AD_PLAN/);
 await assert.rejects(plans.validateCampaign(id,input.courseTitle,'meta_ads',1001,100),/AD_BUDGET/);
 await assert.rejects(plans.validateCampaign(id,input.courseTitle,'meta_ads',200,201),/AD_BUDGET/);
 await plans.validateCampaign(id,input.courseTitle,'meta_ads',200,100);
 row.catalog_hash='v2';await assert.rejects(plans.validateCampaign(id,input.courseTitle,'meta_ads',200,100),/AD_CHANGED/);
});
