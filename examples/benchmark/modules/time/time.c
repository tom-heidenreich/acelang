#include <stdio.h>
#include <windows.h>

unsigned long long current_milliseconds() {
    SYSTEMTIME st;
    GetSystemTime(&st);
    unsigned long long ms = (unsigned long long)st.wMilliseconds + ((unsigned long long)st.wSecond * 1000) + ((unsigned long long)st.wMinute * 60000) + ((unsigned long long)st.wHour * 3600000);
    return ms;
}