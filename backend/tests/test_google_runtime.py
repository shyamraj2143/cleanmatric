def test_google_auth_requests_transport_is_available():
    from google.auth.transport.requests import Request

    transport = Request()
    assert callable(transport)
