using System;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class IgnoreXssAttribute : Attribute
{
}