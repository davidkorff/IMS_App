namespace IMSPortal.Core.Models;

public class IMSInstance
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string EncryptedPassword { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public virtual User User { get; set; } = null!;
    public virtual ICollection<ExternalConnection> Connections { get; set; } = new List<ExternalConnection>();
    public virtual ICollection<CronJob> CronJobs { get; set; } = new List<CronJob>();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}