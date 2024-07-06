from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time

# List of Facebook profile URLs to automate
profile_urls = [
    "https://www.facebook.com/tal.navot.1",
    # Add more profile URLs here
]

def setup_driver():
    # Set up the Chrome WebDriver (make sure you have chromedriver installed and in PATH)
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    return webdriver.Chrome(options=options)

def like_post(driver):
    try:
        like_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Like']"))
        )
        like_button.click()
        print('Liked post')
    except TimeoutException:
        print('Like button not found')

def send_friend_request(driver):
    try:
        add_friend_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//div[@aria-label='Add friend']"))
        )
        add_friend_button.click()
        print('Sent friend request')
    except TimeoutException:
        print('Add friend button not found')

def perform_automation(driver, url):
    driver.get(url)
    time.sleep(5)  # Wait for page to load
    like_post(driver)
    time.sleep(2)  # Wait before sending friend request
    send_friend_request(driver)

def main():
    driver = setup_driver()
    
    for url in profile_urls:
        perform_automation(driver, url)
        time.sleep(5)  # Wait before moving to the next profile
    
    driver.quit()

if __name__ == "__main__":
    main()