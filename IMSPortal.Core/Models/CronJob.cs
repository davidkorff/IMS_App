namespace IMSPortal.Core.Models;

public class CronJob
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Schedule { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public Guid IMSInstanceId { get; set; }
    public virtual IMSInstance IMSInstance { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}