from selenium import selenium
import unittest, time, re

class tsp_test(unittest.TestCase):
  addresses = [ "301 UNIVERSITY AVE , PALO ALTO, CA 94301",
                "950 STANFORD SHOPPING CTR, PALO ALTO, CA 94304",
                "400 HAMILTON AVE, PALO ALTO, CA 94301",
                "420 COWPER ST, PALO ALTO, CA 94301",
                "600 QUARRY RD, PALO ALTO, CA 94304",
                "500 STANFORD SHOPPING CTR, PALO ALTO, CA 94304",
                "300 PASTEUR DR, PALO ALTO, CA 94304", 
                "735 SANTA CRUZ AVE, MENLO PARK, CA 94025", 
                "459 LAGUNITA DR BLDG TRESIDDER, STANFORD, CA 94305",
                "505 CALIFORNIA AVE, PALO ALTO, CA 94304",
                "721 COLORADO AVE, PALO ALTO, CA 94303",
                "325 SHARON PARK DR, MENLO PARK, CA 94025",
                "3200 ALPINE RD, PORTOLA VALLEY, CA 94028",
                "1500 WOODSIDE RD, REDWOOD CITY, CA 94061", 
                "4540 EL CAMINO REAL, LOS ALTOS, CA 94022",
                "2600 EL CAMINO REAL W, MOUNTAIN VIEW, CA 94040",
                "1900 BROADWAY ST, REDWOOD CITY, CA 94063",
                "1071 EL CAMINO REAL, REDWOOD CITY, CA 94063",
                "900 VETERANS BLVD, REDWOOD CITY, CA 94063",
                "2925 WOODSIDE RD, WOODSIDE, CA 94062",
                "100 MAIN ST, LOS ALTOS, CA 94022",
                "570 N SHORELINE BLVD, MOUNTAIN VIEW, CA 94043",
                "590 CASTRO ST, MOUNTAIN VIEW, CA 94041",
                "809 CUESTA DR STE D, MOUNTAIN VIEW, CA 94040",
                "1750 MIRAMONTE AVE, MOUNTAIN VIEW, CA 94040" ]
  test_server_path = "/optimap/test/test.html"
                  
  def setUp(self):
    self.verificationErrors = []
    self.selenium = selenium("localhost", 4444, "*chrome", "http://gebweb.net/")
    self.selenium.start()
    
  def test_tsp_add_addresses_solve_5(self):
    sel = self.selenium
    sel.open(self.test_server_path)
    for i in xrange(5):
      sel.type("addressStr", self.addresses[i])
      sel.click("//input[@value='Add!']")
      sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
    sel.click("button1")
    sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
    try: self.failUnless(sel.is_text_present("0 1 4 3 2 0"))
    except AssertionError, e: self.verificationErrors.append(str(e))
    try: self.failUnless(sel.is_text_present("Trip duration"))
    except AssertionError, e: self.verificationErrors.append(str(e))
        
  def test_tsp_add_addresses_solve_10(self):
    sel = self.selenium
    sel.open(self.test_server_path)
    for i in xrange(10):
      sel.type("addressStr", self.addresses[i])
      sel.click("//input[@value='Add!']")
      sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
    sel.click("button1")
    sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
    try: self.failUnless(sel.is_text_present("0 3 2 9 8 6 4 5 1 7 0"))
    except AssertionError, e: self.verificationErrors.append(str(e))
    try: self.failUnless(sel.is_text_present("Trip duration"))
    except AssertionError, e: self.verificationErrors.append(str(e))
        
  def test_tsp_add_addresses_solve_15(self):
    sel = self.selenium
    sel.open(self.test_server_path)
    for i in xrange(15):
      sel.type("addressStr", self.addresses[i])
      sel.click("//input[@value='Add!']")
      sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
    sel.click("button1")
    sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
    try: self.failUnless(sel.is_text_present("0 3 2 9 10 14 8 12 13 11 6 4 5 1 7 0"))
    except AssertionError, e: self.verificationErrors.append(str(e))
    try: self.failUnless(sel.is_text_present("Trip duration"))
    except AssertionError, e: self.verificationErrors.append(str(e))

  def test_tsp_add_addresses_solve_20(self):
    sel = self.selenium
    sel.open(self.test_server_path)
    for i in xrange(20):
      sel.type("addressStr", self.addresses[i])
      sel.click("//input[@value='Add!']")
      sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
    sel.click("button1")
    sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
    dur = int(sel.get_eval("selenium.browserbot.getCurrentWindow().tsp.getTotalDuration()"))
    print dur
    try: self.failUnless(dur < 7000 and dur > 6000)
    except AssertionError, e: self.verificationErrors.append(str(e))
    try: self.failUnless(sel.is_text_present("Trip duration"))
    except AssertionError, e: self.verificationErrors.append(str(e))

  def test_tsp_add_addresses_solve_25(self):
    sel = self.selenium
    sel.open(self.test_server_path)
    for i in xrange(25):
      sel.type("addressStr", self.addresses[i])
      sel.click("//input[@value='Add!']")
      sel.wait_for_condition("selenium.browserbot.getCurrentWindow().tsp.isReady() == true", "30000")
    sel.click("button1")
    sel.wait_for_condition("selenium.browserbot.getCurrentWindow().isDone == true", "30000")
    dur = int(sel.get_eval("selenium.browserbot.getCurrentWindow().tsp.getTotalDuration()"))
    print dur
    try: self.failUnless(dur < 8700 and dur > 7500)
    except AssertionError, e: self.verificationErrors.append(str(e))
    try: self.failUnless(sel.is_text_present("Trip duration"))
    except AssertionError, e: self.verificationErrors.append(str(e))
        
  def tearDown(self):
    self.selenium.stop()
    self.assertEqual([], self.verificationErrors)

if __name__ == "__main__":
  unittest.main()
