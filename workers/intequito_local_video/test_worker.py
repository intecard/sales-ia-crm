import unittest
from worker import WorkerError, hms, subtitle_text, workflow_replace

class WorkerSafetyTests(unittest.TestCase):
    def test_real_api_placeholders_required(self):
        model={
            '1':{'class_type':'LoadImage','inputs':{'image':'__INTEQUITO_IMAGE__'}},
            '2':{'class_type':'CLIPTextEncode','inputs':{'text':'__INTEQUITO_PROMPT__'}},
            '3':{'class_type':'SaveVideo','inputs':{'filename_prefix':'__INTEQUITO_PREFIX__'}},
        }
        output=workflow_replace(model,{
            '__INTEQUITO_IMAGE__':'intequito-oficial.png',
            '__INTEQUITO_PROMPT__':'INTEQUITO caminando y saludando',
            '__INTEQUITO_PREFIX__':'inteca-test'
        })
        self.assertEqual(output['1']['inputs']['image'],'intequito-oficial.png')
        self.assertEqual(output['2']['inputs']['text'],'INTEQUITO caminando y saludando')
        self.assertEqual(model['1']['inputs']['image'],'__INTEQUITO_IMAGE__')
    def test_refuses_fake_workflow_without_image(self):
        with self.assertRaises(WorkerError):
            workflow_replace({'1':{'inputs':{'text':'__INTEQUITO_PROMPT__'}}},{
                '__INTEQUITO_IMAGE__':'x','__INTEQUITO_PROMPT__':'y','__INTEQUITO_PREFIX__':'z'
            })
    def test_srt_timing(self):
        text=subtitle_text([
            {'from':0,'to':3,'dialogue':'Hola soy INTEQUITO.'},
            {'from':3,'to':10,'dialogue':'Escríbenos al 809-643-5502.'},
        ])
        self.assertIn('00:00:00,000 --> 00:00:03,000',text)
        self.assertIn('00:00:03,000 --> 00:00:10,000',text)
        self.assertIn('809-643-5502',text)
        self.assertEqual(hms(60.512),'00:01:00,512')
    def test_bad_time_rejected(self):
        with self.assertRaises(WorkerError):
            subtitle_text([{'from':5,'to':4,'dialogue':'bad'}])

if __name__=='__main__':
    unittest.main()
