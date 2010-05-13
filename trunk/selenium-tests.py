from selenium import selenium
import unittest, time, re

class tsp_test(unittest.TestCase):
    def setUp(self):
        self.verificationErrors = []
        self.selenium = selenium("localhost", 4444, "*chrome", "http://gebweb.net/")
        self.selenium.start()
    
    def test_tsp_add_addresses_solve(self):
        sel = self.selenium
        sel.open("/optimap/test.html")
        sel.type("addressStr", "301 UNIVERSITY AVE , PALO ALTO, CA 94301")
        sel.click("//input[@value='Add!']")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
        sel.type("addressStr", "950 STANFORD SHOPPING CTR, PALO ALTO, CA 94304")
        sel.click("//input[@value='Add!']")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
        sel.type("addressStr", "400 HAMILTON AVE, PALO ALTO, CA 94301")
        sel.click("//input[@value='Add!']")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
        sel.type("addressStr", "420 COWPER ST, PALO ALTO, CA 94301")
        sel.click("//input[@value='Add!']")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
        sel.type("addressStr", "600 QUARRY RD, PALO ALTO, CA 94304")
        sel.click("//input[@value='Add!']")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
        sel.click("button1")
        sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
        try: self.failUnless(sel.is_text_present("0 1 4 3 2 0"))
        except AssertionError, e: self.verificationErrors.append(str(e))
        try: self.failUnless(sel.is_text_present("Trip duration"))
        except AssertionError, e: self.verificationErrors.append(str(e))
    
    def tearDown(self):
        self.selenium.stop()
        self.assertEqual([], self.verificationErrors)

if __name__ == "__main__":
    unittest.main()
