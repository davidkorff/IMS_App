namespace IMSPortal.Core.Models;

public class ExternalConnection
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ConnectionString { get; set; } = string.Empty;
    public string DatabaseType { get; set; } = string.Empty;
    public Guid IMSInstanceId { get; set; }
    public virtual IMSInstance IMSInstance { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
} 