package com.macro.mall.tiny.neo;

import com.aliyuncs.credentials.models.JWTTOKENClient;
import com.aliyuncs.credentials.models.JWTTokenClientFactory;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UtilsTest {

    @Test
    void getToken_shouldReturnToken_fromMockedClient() {
        // given
        String expectedToken = "mock-token-123";

        JWTTokenClientFactory factoryMock = mock(JWTTokenClientFactory.class);
        JWTTOKENClient clientMock = mock(JWTTOKENClient.class);

        when(factoryMock.getJWtkenClient(any(), any())).thenReturn(clientMock);
        when(clientMock.getToken()).thenReturn(expectedToken);

        // mock static: JWTTokenClientFactory.getInstance()
        try (MockedStatic<JWTTokenClientFactory> mockedStatic = mockStatic(JWTTokenClientFactory.class)) {
            mockedStatic.when(JWTTokenClientFactory::getInstance).thenReturn(factoryMock);

            // when
            String actual = Utils.getToken("acc", "key", "secret");

            // then
            assertEquals(expectedToken, actual);

            // verify interactions
            mockedStatic.verify(JWTTokenClientFactory::getInstance, times(1));
            verify(factoryMock, times(1)).getJWtkenClient(any(), any());
            verify(clientMock, times(1)).getToken();
            verifyNoMoreInteractions(factoryMock, clientMock);
        }
    }

    @Test
    void getToken_shouldPropagateException_whenClientThrows() {
        // given
        RuntimeException boom = new RuntimeException("boom");

        JWTTokenClientFactory factoryMock = mock(JWTTokenClientFactory.class);
        JWTTOKENClient clientMock = mock(JWTTOKENClient.class);

        when(factoryMock.getJWtkenClient(any(), any())).thenReturn(clientMock);
        when(clientMock.getToken()).thenThrow(boom);

        try (MockedStatic<JWTTokenClientFactory> mockedStatic = mockStatic(JWTTokenClientFactory.class)) {
            mockedStatic.when(JWTTokenClientFactory::getInstance).thenReturn(factoryMock);

            // when + then
            try {
                Utils.getToken("acc", "key", "secret");
            } catch (RuntimeException ex) {
                assertEquals("boom", ex.getMessage());
            }

            mockedStatic.verify(JWTTokenClientFactory::getInstance, times(1));
            verify(factoryMock, times(1)).getJWtkenClient(any(), any());
            verify(clientMock, times(1)).getToken();
        }
    }
}