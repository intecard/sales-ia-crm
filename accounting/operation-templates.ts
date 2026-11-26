import type {Journal,ACCOUNTS} from './engine.ts';
export const draftKinds=['receivable','collection','payable','supplier_payment','payroll_accrual','payroll_payment','tax_payment','withholding_payment'] as const;
export const operationTemplate:Record<typeof draftKinds[number],{label:string;kind:Journal['kind'];debit:keyof typeof ACCOUNTS;credit:keyof typeof ACCOUNTS}>={
 receivable:{label:'Venta a crédito',kind:'sale',debit:'1102',credit:'4101'},
 collection:{label:'Cobro de cuenta por cobrar',kind:'collection',debit:'1101',credit:'1102'},
 payable:{label:'Gasto a crédito',kind:'purchase',debit:'6101',credit:'2101'},
 supplier_payment:{label:'Pago de cuenta a proveedor',kind:'payment',debit:'2101',credit:'1101'},
 payroll_accrual:{label:'Nómina devengada · sin desglose',kind:'journal',debit:'6102',credit:'2104'},
 payroll_payment:{label:'Nómina pagada · con constancia',kind:'payment',debit:'2104',credit:'1101'},
 tax_payment:{label:'ITBIS pagado · con constancia',kind:'payment',debit:'2102',credit:'1101'},
 withholding_payment:{label:'Retenciones pagadas · con constancia',kind:'payment',debit:'2103',credit:'1101'},
};
