import pprint
from langchain_community.utilities import SearxSearchWrapper

search = SearxSearchWrapper(searx_host="http://localhost:70")

search.run("What is the capital of France")

pprint.pprint(search.results("What is the capital of France", num_results=10))
